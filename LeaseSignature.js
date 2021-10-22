import React, { useEffect, useState } from "react";
import styled from "styled-components";
import FontSize from "../../../../Theme/FontSize";
import Scale from "../../../../Theme/Scale";
import { red, warmGray } from "../../../../Theme/Color";
import { CircularProgress, TextField } from "@material-ui/core";
import {
  ExclamationCircleIcon,
  PlusIcon,
  UserIcon,
} from "@heroicons/react/solid";
import { XIcon } from "@heroicons/react/outline";
import { DocumentAddIcon } from "@heroicons/react/solid";
import CreateTemplateDialog from "../../../../Templates/CreateTemplateDialog";
import TemplateGridItem from "./TemplateGridItem";
import NumberFormat from "react-number-format";
import { sendLease } from "../../../../../Backend/Services/Firebase/Signature/signatureService";
import { withSnackbar } from "../../../../../Context/Snackbar";
import { Autocomplete } from "@material-ui/lab";
import HelloSign from "hellosign-embedded";
import { db } from "../../../../../Backend/Services/Firebase/Firebase";

const RootContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${Scale(5)};
`;

const HorizontalFlex = styled.div`
  display: flex;
  gap: ${Scale(4)};
  align-items: center;
  padding: 0 ${Scale(6)};
`;

const LabelledInput = styled.div`
  p {
    color: ${warmGray(700)};
    font-weight: 500;
    font-size: ${FontSize(2)};
    margin-bottom: ${Scale(1)};
    span {
      font-style: italic;
      font-size: ${FontSize(1)};
      font-weight: 400;
    }
  }
  h5 {
    color: ${warmGray(700)};
    font-size: ${FontSize(4)};
  }
  & .MuiFormControl-root {
    width: 100%;
  }
  & .MuiInputBase-root {
    border-radius: ${Scale(2)};
    padding: ${Scale(1)} ${Scale(3)};
    border: 1px solid ${warmGray(300)};
    font-size: ${FontSize(2)};
    font-weight: 500;
    color: ${warmGray(700)};
  }
  & .MuiFormHelperText-root {
    font-size: ${FontSize(1)};
    color: ${warmGray(600)};
  }
  & .Mui-error {
    color: ${red(500)};
  }
`;

const SigneeContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${Scale(3)};
`;

const TertiaryButton = styled.button`
  cursor: pointer;
  border: none;
  outline: none;
  background-color: transparent;
  color: ${warmGray(700)};
  font-weight: 500;
  font-size: ${FontSize(2)};
  display: flex;
  align-items: center;
  gap: ${Scale(2)};
  margin-left: auto;
`;

const Label = styled.p`
  color: ${warmGray(700)};
  font-weight: 500;
  font-size: ${FontSize(2)};
`;

const Confirmbutton = styled.button`
  cursor: pointer;
  border: none;
  outline: none;
  margin-left: auto;
  background-color: ${red(400)};
  color: white;
  border-radius: ${Scale(2)};
  font-size: ${FontSize(2)};
  width: ${Scale(9)};
  padding: ${Scale(2)} 0;
`;

const SignersContainer = styled.div`
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${Scale(6)};
`;

const Subsection = styled.h3`
  font-weight: 600;
  color: ${warmGray(700)};
  font-size: ${FontSize(2)};
  padding: 0 ${Scale(6)};
`;

const SectionInformation = styled.p`
  font-weight: 400;
  color: ${warmGray(600)};
  font-size: ${FontSize(2)};
  padding: 0 ${Scale(6)};
  max-width: 30rem;
`;

const TemplatesGrid = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(${Scale(12)}, 1fr));
  grid-auto-rows: 1fr;
  column-gap: ${Scale(5)};
  row-gap: ${Scale(4)};
`;

const StyledTextField = styled(TextField)`
  & .MuiInputBase-root {
    border: 1px solid ${warmGray(200)} !important;
    border-radius: ${Scale(2)};
    padding: ${Scale(2)} !important;
  }
  > * {
    background-color: transparent;
    border: none;
    ::before {
      border-bottom: none;
    }
    padding: 0 !important;
    margin: 0 !important;
    font-size: ${FontSize(2)};
  }
  & .Mui-focused {
    background-color: transparent;
    ::before {
      border-bottom: none;
    }
  }
  & .MuiFilledInput-input {
    padding: 0 !important;
  }
  & .MuiInputBase-root {
    background-color: transparent;
    font-size: ${FontSize(2)};
    :hover {
      background-color: transparent;
      ::before {
        border-bottom: none;
      }
    }
    :focus {
      background-color: transparent;
    }
  }
  & .MuiAutocomplete-inputRoot {
    padding: 0;
  }
  & .MuiAutocomplete-root {
    :focus {
      background-color: transparent;
    }
  }
`;

const client = new HelloSign();

function LeaseSignature(props) {
  const [signers, setSigners] = useState([
    { name: "", email_address: "", role: "" },
  ]);
  const [requestInfo, setRequestInfo] = useState({
    title: "",
    subject: "",
    message: "",
  });
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [creating, setCreating] = useState(false);

  const handleAddSigner = () => {
    setSigners((prevSigners) => {
      let newSigners = [...prevSigners];
      newSigners.push({ name: "", email_address: "", role: "" });

      return newSigners;
    });
  };

  const handleRemove = (index) => {
    setSigners((prevSigners) => {
      let newSigners = [...prevSigners];
      newSigners.splice(index, 1);

      return newSigners;
    });
  };

  const handleSignerChange = (index, key, value) => {
    setSigners((prevSigners) => {
      let newSigners = [...prevSigners];
      newSigners[index][key] = value;

      return newSigners;
    });
  };

  const handleRequestChange = (key, value) => {
    setRequestInfo((prevInfo) => {
      let newInfo = { ...prevInfo };
      newInfo[key] = value;

      return newInfo;
    });
  };

  useEffect(() => {
    console.log("Effecting");
    setSigners((prevSigners) => {
      let newSigners = prevSigners.map((signer) => {
        return {
          email_address: signer.email_address,
          name: signer.name,
          role: "",
        };
      });

      console.log(JSON.stringify(newSigners));
      return newSigners;
    });
  }, [selectedTemplate]);

  const handleOnSend = () => {
    setCreating(true);
    var unsubscribe = db
      .collection("applications")
      .doc(props.application.id)
      .onSnapshot((documentSnapshot) => {
        console.log("listener fired");
        console.log(JSON.stringify(documentSnapshot.data()));
        if (documentSnapshot.data().lease_request) {
          console.log(documentSnapshot.data().lease_request);

          unsubscribe();
          props.handleRequestSent(documentSnapshot.data().lease_request);
        }
      });
  };

  const handleSend = () => {
    sendLease(
      props.application.id,
      selectedTemplate,
      signers,
      requestInfo.title,
      requestInfo.subject,
      requestInfo.message,
      (success, data) => {
        if (success) {
          console.log(JSON.stringify(data));
          client.open(data.claim_url, {
            clientId: data.client_id,
            skipDomainVerification: true,
          });

          client.on("send", (data) => {
            handleOnSend();
          });
        } else {
          props.snackbarShowMessage("Error sending lease. Try Again.");
        }
      }
    );
  };

  const userHasError = (signer) => {
    if (
      signer.name.length < 1 ||
      signer.email_address.length < 1 ||
      signer.role.length < 1
    ) {
      return true;
    }

    return false;
  };

  return (
    <RootContainer disabled={creating}>
      {!props.application.pending_credit_checks ? (
        <>
          <HorizontalFlex>
            <div>
              <Subsection style={{ marginTop: Scale(2), padding: 0 }}>
                Documents
              </Subsection>
              <SectionInformation style={{ padding: 0 }}>
                Choose a template from your existing library or create a new
                template
              </SectionInformation>
            </div>

            <TertiaryButton onClick={() => setShowCreateTemplate(true)}>
              <DocumentAddIcon height={Scale(5)} color={warmGray(400)} />
              Create a new template
            </TertiaryButton>
          </HorizontalFlex>
          <HorizontalFlex
            style={{
              paddingBottom: Scale(5),
              borderBottom: `1px solid ${warmGray(300)}`,
            }}
          >
            <TemplatesGrid>
              {props.templates
                ? props.templates.map((template) => (
                    <TemplateGridItem
                      template={template}
                      selected={template.id === selectedTemplate}
                      setSelectedTemplate={setSelectedTemplate}
                    />
                  ))
                : Array(5)
                    .fill()
                    .map(() => <TemplateGridItem />)}
            </TemplatesGrid>
          </HorizontalFlex>

          <CreateTemplateDialog
            open={showCreateTemplate}
            setOpen={setShowCreateTemplate}
            handleClose={() => setShowCreateTemplate(false)}
            refresh={props.getTemplates}
          />

          <Subsection>Signatories</Subsection>
          <HorizontalFlex>
            <SignersContainer>
              {signers.map((signer, index) => (
                <SigneeContainer style={{ gap: Scale(1) }}>
                  <XIcon
                    height={Scale(4)}
                    style={{ marginLeft: "auto", cursor: "pointer" }}
                    onClick={() => handleRemove(index)}
                  />
                  <HorizontalFlex
                    style={{ alignItems: "flex-start", padding: "0" }}
                  >
                    <UserIcon
                      height={Scale(5)}
                      color={warmGray(700)}
                      style={{
                        padding: Scale(2),
                        backgroundColor: warmGray(200),
                        borderRadius: Scale(2),
                      }}
                    />
                    <SigneeContainer style={{ flex: 1 }}>
                      <LabelledInput>
                        <HorizontalFlex
                          style={{ padding: 0, alignItems: "center" }}
                        >
                          <p>Legal Name</p>
                          {userHasError(signers[index]) && (
                            <>
                              <p style={{ marginLeft: "auto" }}>
                                <span>All fields must be completed</span>
                              </p>
                              <ExclamationCircleIcon
                                height={Scale(4)}
                                color={red(500)}
                                style={{
                                  marginBottom: Scale(1),
                                }}
                              />
                            </>
                          )}
                        </HorizontalFlex>
                        <TextField
                          InputProps={{ disableUnderline: true }}
                          value={signers[index].name}
                          onChange={(event) =>
                            handleSignerChange(
                              index,
                              "name",
                              event.target.value
                            )
                          }
                        />
                      </LabelledInput>

                      <LabelledInput>
                        <p>Email</p>
                        <TextField
                          InputProps={{ disableUnderline: true }}
                          value={signers[index].email_address}
                          onChange={(event) =>
                            handleSignerChange(
                              index,
                              "email_address",
                              event.target.value
                            )
                          }
                        />
                      </LabelledInput>

                      <LabelledInput>
                        <p>Template Role</p>
                        <Autocomplete
                          id="combo-box"
                          noOptionsText="Select a template first"
                          options={
                            selectedTemplate && props.templates
                              ? props.templates.find(
                                  (t) => t.id === selectedTemplate
                                ).roles
                              : []
                          }
                          getOptionLabel={(option) => option}
                          selectOnFocus
                          clearOnBlur
                          handleHomeEndKeys
                          renderOption={(option) => (
                            <LabelledInput>
                              <p>{option}</p>
                            </LabelledInput>
                          )}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="Role"
                              InputProps={{
                                ...params.InputProps,
                                disableUnderline: true,
                              }}
                            />
                          )}
                          controlled
                          defaultValue={signers[index].role}
                          value={signers[index].role}
                          onChange={(event) =>
                            handleSignerChange(
                              index,
                              "role",
                              event.target.textContent
                            )
                          }
                        />
                      </LabelledInput>
                    </SigneeContainer>
                  </HorizontalFlex>
                </SigneeContainer>
              ))}
            </SignersContainer>
          </HorizontalFlex>
          <div
            style={{
              width: "100%",
              borderBottom: `1px solid ${warmGray(300)}`,
              paddingBottom: Scale(4),
            }}
          >
            <SigneeContainer
              onClick={handleAddSigner}
              style={{
                cursor: "pointer",
                marginTop: Scale(3),
                width: "max-content",
              }}
            >
              <HorizontalFlex style={{ width: "max-content" }}>
                <PlusIcon
                  height={Scale(5)}
                  color={warmGray(700)}
                  style={{
                    padding: Scale(2),
                    backgroundColor: warmGray(200),
                    borderRadius: Scale(2),
                  }}
                />
                <TertiaryButton>Add Another</TertiaryButton>
              </HorizontalFlex>
            </SigneeContainer>
          </div>

          <HorizontalFlex>
            <div>
              <Subsection style={{ marginTop: Scale(2), padding: 0 }}>
                Details
              </Subsection>
              <SectionInformation style={{ padding: 0 }}>
                Set a non-refundable price per credit check to be paid by each
                user and decide how you want the user to be emailed.
              </SectionInformation>
            </div>
          </HorizontalFlex>

          <HorizontalFlex style={{ gap: Scale(8) }}>
            <LabelledInput style={{ flex: 1 }}>
              <p>Email Title</p>
              <TextField
                InputProps={{ disableUnderline: true }}
                value={requestInfo.title}
                onChange={(event) =>
                  handleRequestChange("title", event.target.value)
                }
              />
            </LabelledInput>

            <LabelledInput style={{ flex: 1 }}>
              <p>Email Subject</p>
              <TextField
                InputProps={{ disableUnderline: true }}
                value={requestInfo.subject}
                onChange={(event) =>
                  handleRequestChange("subject", event.target.value)
                }
              />
            </LabelledInput>
          </HorizontalFlex>

          <HorizontalFlex style={{ gap: Scale(8) }}>
            <LabelledInput style={{ flex: 1 }}>
              <p>Email Message</p>
              <TextField
                multiline
                minRows={4}
                InputProps={{ disableUnderline: true }}
                value={requestInfo.message}
                onChange={(event) =>
                  handleRequestChange("message", event.target.value)
                }
              />
            </LabelledInput>
          </HorizontalFlex>

          <HorizontalFlex
            style={{
              backgroundColor: warmGray(100),
              padding: ` ${Scale(3)} ${Scale(5)}`,
              borderBottomLeftRadius: Scale(3),
              borderBottomRightRadius: Scale(3),
            }}
          >
            <Confirmbutton onClick={handleSend}>
              {!creating ? (
                "Confirm"
              ) : (
                <CircularProgress size={Scale(4)} color="inherit" />
              )}
            </Confirmbutton>
          </HorizontalFlex>
        </>
      ) : null}
    </RootContainer>
  );
}

export default withSnackbar(LeaseSignature);
