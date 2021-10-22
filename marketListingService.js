import moment from "moment";
import { db, storage } from "../Firebase";
import { v4 as uuid } from "uuid";
import firebase from "firebase";

export const retrieveListings = (broker_id, callback) => {
  //fetches all listings for a specific broker_id, and returns results to escaping callback function
  const listings = [];
  const promises = [
    db
      .collection("listings")
      .where("broker_ids", "array-contains", broker_id)
      .get(),
    db.collection("listings").where("owner_id", "==", broker_id).get(),
  ]; //check for both broker_id and owner_id match

  Promise.all(promises).then((promises) => {
    promises.forEach((querySnapshot) => {
      querySnapshot.docs.forEach((listingSnapshot) => {
        const listing = listingSnapshot.data();
        listing.id = listingSnapshot.id; //add id to object for key-ing later
        listings.push(listing);
      });
    });

    const filteredListings = [
      //filter unique listing ids
      ...new Map(listings.map((listing) => [listing["id"], listing])).values(),
    ];

    const desiredBrokers = filteredListings.flatMap((listing) => {
      //get ids of all broker and owners on all associated listings
      return [...listing.broker_ids, listing.owner_id];
    });

    const uniqueBrokers = [...new Set(desiredBrokers)]; //remove duplicates in preparation for fetching
    const brokerPromises = uniqueBrokers.map((brokerId) => {
      //fetch all unique broker profiles
      return db.collection("broker_profiles").doc(brokerId).get();
    });

    Promise.all(brokerPromises).then((brokerSnapshots) => {
      brokerSnapshots.forEach((brokerSnapshot) => {
        //loop through each profile snapshot
        const brokerId = brokerSnapshot.id;
        filteredListings.forEach((listing) => {
          //check through each listing
          if (
            listing.owner_id == brokerId ||
            listing.broker_ids.includes(brokerId)
          ) {
            //if profile snapshot relates to this listings

            //either push data to array or create array
            if (listing.brokers === undefined) {
              listing.brokers = [
                { ...brokerSnapshot.data(), id: brokerSnapshot.id },
              ];
            } else {
              listing.brokers.push({
                ...brokerSnapshot.data(),
                id: brokerSnapshot.id,
              });
            }
          }
        });
      });

      callback(filteredListings); //send callback
    });
  });
};

export const fetchListing = (listingId, setListing) => {
  //fetch a single listing and escaping callback to set state
  db.collection("listings")
    .doc(listingId)
    .get()
    .then((documentSnapshot) => {
      if (documentSnapshot.exists) {
        let listing = {
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        };

        //same unique broker filtering
        const desiredIds = [listing.owner_id, ...listing.broker_ids];
        const uniqueBrokers = [...new Set(desiredIds)];
        const brokerPromises = uniqueBrokers.map((id) => {
          return db.collection("broker_profiles").doc(id).get();
        });

        Promise.all(brokerPromises).then((brokerSnapshots) => {
          const brokers = brokerSnapshots.map((brokerSnapshot) => {
            if (brokerSnapshot.exists) {
              return {
                id: brokerSnapshot.id,
                ...brokerSnapshot.data(),
              };
            }
          });

          listing = {
            ...listing,
            brokers: brokers,
          }; //add profiles to listing object

          setListing(listing);
        });
      }
    });
};

export const fetchListingData = (listingId, completionHandler) => {
  //function to fetch solely listing data, excluding broker profiles
  db.collection("listings")
    .doc(listingId)
    .get()
    .then((documentSnapshot) => {
      if (!documentSnapshot.exists) {
        return completionHandler(true, null);
      } else {
        return completionHandler(true, {
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        });
      }
    })
    .catch((error) => {
      console.error(error);
      return completionHandler(false, error);
    });
};

export const updateMarketListing = (
  //updates or publishes a new listing
  listingId,
  updateData,
  imagesToUpload,
  videosToUpload,
  floorplansToUpload,
  removedPaths,
  completionHandler
) => {
  let constructedUpdateData = { ...updateData }; //new object for manipulation

  const ref = listingId
    ? db.collection("listings").doc(listingId)
    : db.collection("listings").doc(); //get or create ref

  let imagePromises = [];

  for (const imageUrl of [
    ...imagesToUpload,
    ...videosToUpload,
    ...floorplansToUpload,
  ]) {
    const storageRef = storage.ref(
      `/listing_images/${listingId ? listingId : ref.id}/${uuid()}`
    ); //assign unique storage refs

    imagePromises.push(storageRef.putString(imageUrl, "data_url")); //upload data
  }

  Promise.all(imagePromises).then((snapshots) => {
    //once all uploads complete
    let paths = [];
    snapshots.forEach((snapshot) => {
      paths.push(snapshot.ref.fullPath);
    }); //push path

    paths.forEach((path, index) => {
      //loop through uploaded paths and assign them to correct fields in object
      if (index < imagesToUpload.length) {
        constructedUpdateData.images = constructedUpdateData.images
          ? [...constructedUpdateData.images, path]
          : [path];
      } else if (index < imagesToUpload.length + videosToUpload.length) {
        constructedUpdateData.videos = constructedUpdateData.videos
          ? [...constructedUpdateData.videos, path]
          : [path];
      } else {
        constructedUpdateData.floorplans = constructedUpdateData.floorplans
          ? [...constructedUpdateData.floorplans, path]
          : [path];
      }
    });

    for (const path of removedPaths) {
      storage.ref(path).delete(); //if any removed...
    }

    //perform update operation
    ref
      .set(constructedUpdateData, { merge: true })
      .then(() => {
        return completionHandler(true, {
          id: listingId ? listingId : ref.id,
          imageUrls: constructedUpdateData.images,
          floorplanUrls: constructedUpdateData.floorplans,
          videoUrls: constructedUpdateData.videos,
          listing: constructedUpdateData,
        });
      })
      .catch((error) => {
        console.error(error);
        return completionHandler(false, error);
      });
  });
};

export const fetchOffers = (listingId, mergeOffers) => {
  //fetch offers on a listing, and callback to merge offers with existing state
  db.collection("offers")
    .where("listing_id", "==", listingId)
    .orderBy("created", "asc")
    .get()
    .then((querySnapshot) => {
      const offers = querySnapshot.docs.map((documentSnapshot) => {
        return {
          ...documentSnapshot.data(),
          id: documentSnapshot.id,
        };
      });

      mergeOffers({ offers: offers }, listingId, false);
    });
};

export const fetchApplications = (listingId, mergeApplications) => {
  //fetch offers on a listing, and callback to merge applications with existing state
  db.collection("applications")
    .where("listing_id", "==", listingId)
    .get()
    .then((querySnapshot) => {
      let applications = querySnapshot.docs.map((documentSnapshot) => {
        return {
          ...documentSnapshot.data(),
          id: documentSnapshot.id,
        };
      });

      let promises = applications.map((application) => {
        return db.collection("user_profiles").doc(application.user_id).get();
      });

      Promise.all(promises).then((documentSnapshots) => {
        for (const snapshot of documentSnapshots) {
          if (snapshot.exists) {
            const id = snapshot.id;
            const index = applications.findIndex(
              (application) => application.user_id == id
            );
            applications[index].userProfile = {
              ...snapshot.data(),
              id: id,
            };
          }
        }

        mergeApplications({ applications: applications }, listingId, false);
      });
    });
};

export const fetchRecentAppointments = (listingId, mergeAppointments) => {
  db.collection("appointments")
    .where("listing_id", "==", listingId)
    .where("state", "==", "accepted")
    .orderBy("date")
    .startAt(moment().subtract(14, "days").toDate())
    .get()
    .then((querySnapshot) => {
      const constructedAppointments = querySnapshot.docs.map(
        (documentSnapshot) => {
          return {
            ...documentSnapshot.data(),
            id: documentSnapshot.id,
          };
        }
      );

      mergeAppointments(
        { recentAppointments: constructedAppointments },
        listingId,
        false
      );
    })
    .catch((error) => {
      console.log(error);
    });
};

export const fetchAppointments = (listingId, mergeAppointments) => {
  db.collection("appointments")
    .where("listing_id", "==", listingId)
    .orderBy("date")
    .get()
    .then((querySnapshot) => {
      let constructedAppointments = querySnapshot.docs.map(
        (documentSnapshot) => {
          return {
            ...documentSnapshot.data(),
            id: documentSnapshot.id,
          };
        }
      );

      const promises = constructedAppointments.map((appointment) => {
        return db.collection("user_profiles").doc(appointment.user_id).get();
      });

      Promise.all(promises).then((documentSnapshots) => {
        constructedAppointments = constructedAppointments.map((appointment) => {
          const userId = appointment.user_id;
          const profileSnapshot = documentSnapshots.find(
            (documentSnapshot) => documentSnapshot.id == userId
          );

          return {
            ...appointment,
            userProfile: profileSnapshot.data(),
          };
        });

        mergeAppointments(
          { appointments: constructedAppointments },
          listingId,
          false
        );
      });
    })
    .catch((error) => {
      console.log(error);
    });
};

export const fetchViews = (listingId, mergeViews) => {
  db.collection("listing_views")
    .doc(listingId)
    .get()
    .then((documentSnapshot) => {
      if (documentSnapshot.exists) {
        mergeViews({ ...documentSnapshot.data() }, listingId, true);
      }
    });
};

export const updateImages = (imageList, listingId) => {
  return db.collection("listings").doc(listingId).update({ images: imageList });
};

export const addImages = (
  imageDataList,
  listingId,
  setLoading,
  addImageUrl
) => {
  let uploadPromises = [];
  imageDataList.forEach((imageData) => {
    const ref = storage.ref().child(`/listing_images/${listingId}}/${uuid()}`);

    const promise = ref.put(imageData);

    uploadPromises.push(promise);
  });

  Promise.all(uploadPromises).then((snapshots) => {
    const urlPromises = [];
    snapshots.forEach((snapshot) => {
      const urlPromise = snapshot.ref.getDownloadURL();
      urlPromises.push(urlPromise);
    });

    Promise.all(urlPromises).then((downloadUrls) => {
      console.log(downloadUrls);
      db.collection("listings")
        .doc(listingId)
        .update({
          images: firebase.firestore.FieldValue.arrayUnion(...downloadUrls),
        })
        .then(() => {
          setLoading(false);
          addImageUrl(...downloadUrls);
        });
    });
  });
};

export const updateListing = (data, listingId) => {
  const docData = { ...data };
  delete docData.id;
  delete docData.day_data;

  if (!Object.keys(docData).includes("unit_number")) {
    docData.unit_number = firebase.firestore.FieldValue.delete();
  }

  const timestamp = new firebase.firestore.Timestamp(
    docData.asking_offer.start_date.seconds,
    docData.asking_offer.start_date.nanoseconds
  ); //manually convert to avoid issues

  return db
    .collection("listings")
    .doc(listingId)
    .update({
      ...docData,
      asking_offer: {
        ...docData.asking_offer,
        start_date: timestamp,
      },
    });
};

export const addBroker = (listingId, brokerId, completionHandler) => {
  //add a broker to a listing
  db.collection("listings")
    .doc(listingId)
    .update({
      broker_ids: firebase.firestore.FieldValue.arrayUnion(brokerId),
    })
    .then(() => {
      return completionHandler(true, null);
    })
    .catch((error) => {
      console.error(error);
      return completionHandler(false, error);
    });
};
