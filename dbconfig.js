module.exports = {
  user          : process.env.NODE_ORACLEDB_USER || "orclmaster",
  password      : process.env.NODE_ORACLEDB_PASSWORD || "orclmaster",
  connectString : process.env.NODE_ORACLEDB_CONNECTIONSTRING || "orcl.cazk8gtvizhb.us-east-1.rds.amazonaws.com:1521/orcl",
};